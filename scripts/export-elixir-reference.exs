# Exports reference values from the original Elixir/Phoenix implementation
# (Avgr.Calculator + AvgrWeb.Components.Curve) as JSON. The TypeScript port is
# regression-tested against this file (tests/fixtures/elixir-reference.json).
#
# The original sources are compiled in memory from the Phoenix checkout, so
# nothing in that project is modified and no server is started.
#
# Usage:
#   AVGR=../avgr.app
#   elixir -pa $AVGR/_build/dev/lib/decimal/ebin -pa $AVGR/_build/dev/lib/jason/ebin \
#     scripts/export-elixir-reference.exs $AVGR > tests/fixtures/elixir-reference.json

[avgr_root] = System.argv()

Code.require_file(Path.join(avgr_root, "lib/avgr/calculator.ex"))
Code.require_file(Path.join(avgr_root, "lib/avgr_web/components/curve.ex"))

alias Avgr.Calculator
alias AvgrWeb.Components.Curve

# Raw strings exactly as a user would type them into the three inputs.
scenarios = [
  {"default", "100", "50", "40"},
  {"small-decimals", "3", "0.1", "0.07"},
  {"penny-stock", "25000", "0.0125", "0.0089"},
  {"high-price", "1", "700000", "650000"},
  {"large-position", "1000000000", "12.5", "9.75"},
  {"averaging-up", "100", "40", "50"},
  {"flat", "100", "50", "50"},
  {"near-flat", "50", "50", "49.99995"},
  {"odd-decimals", "37", "123.456", "98.765"},
  {"exponent-input", "10", "1e3", "7.5e2"},
  {"deep-loss", "200", "100", "5"},
  {"tiny-market-price", "7", "19.99", "0.01"}
]

# Mirrors SimulatorLive.parse_valid_inputs/1 and clamp/3.
parse = fn q0, p0, pm ->
  {q0, ""} = Integer.parse(q0)
  {p0, ""} = Float.parse(p0)
  {pm, ""} = Float.parse(pm)
  {q0, p0, pm}
end

clamp = fn val, min_val, max_val -> max(min_val, min(val, max_val)) end

encode_point = fn p -> Map.take(p, [:capital, :capital_actual, :delta, :new_average, :shares, :efficiency_per_100]) end

results =
  for {name, rq0, rp0, rpm} <- scenarios do
    {q0, p0, pm} = parse.(rq0, rp0, rpm)
    payload = Calculator.build_curve_payload(q0, p0, pm)
    slider_max = payload.slider_max

    capitals =
      [0.0, 1.0, pm - 0.01, pm, pm * 2 + 0.5, slider_max * 0.37, slider_max / 2, slider_max, slider_max * 1.5]
      |> Enum.filter(&(&1 >= 0))

    sims =
      for c <- capitals do
        clamped = clamp.(c, 0, slider_max)
        %{input_capital: c, capital: clamped, result: Calculator.compute_sim_result(q0, p0, pm, clamped)}
      end

    scales = Curve.make_scales(payload.slider_max, payload.delta_max)
    x_ticks = Curve.x_ticks(payload.slider_max, scales)
    y_ticks = Curve.y_ticks(scales)

    %{
      name: name,
      raw: %{q0: rq0, p0: rp0, pm: rpm},
      parsed: %{q0: q0, p0: p0, pm: pm},
      slider_max: payload.slider_max,
      delta_max: payload.delta_max,
      points: Enum.map(payload.points, encode_point),
      sims: sims,
      chart: %{
        y_min: scales.y_min,
        y_max: scales.y_max,
        y_range: scales.y_range,
        asymptote_y: scales.y_scale.(payload.delta_max),
        svg_path: Curve.build_svg_path(payload.points, scales),
        area_path: Curve.build_area_path(payload.points, scales),
        x_ticks: Enum.map(x_ticks, &%{val: &1.val, x: &1.x, label: Curve.format_capital(&1.val)}),
        y_ticks: Enum.map(y_ticks, &%{val: &1.val, y: &1.y, label: Curve.format_delta(&1.val)}),
        asymptote_label: Curve.format_delta(payload.delta_max),
        slider_max_label: Curve.format_capital(payload.slider_max)
      }
    }
  end

formatters = %{
  format_capital:
    for v <- [0.0, 0.4, 0.5, 499.5, 999.4, 999.6, 1000.0, 1449.0, 1450.0, 9999.0, 10_000.0, 14_499.0, 14_500.0,
              999_999.0, 1_000_000.0, 1_250_000.0, 36_000.0, 2.5e9] do
      %{val: v, label: Curve.format_capital(v)}
    end,
  format_delta:
    for v <- [0.0, 0.004, 0.005, 1.5, 2.675, 9.999, 10.0, 12.34, 12.35, 99.95, 100.0, 100.5, 250.4, -0.5, -2.5,
              -10.0, -12.35, -100.5, -1000.0] do
      %{val: v, label: Curve.format_delta(v)}
    end
}

IO.puts(Jason.encode!(%{scenarios: results, formatters: formatters}, pretty: true))
