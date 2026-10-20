import './styles/main.css'
import { startApp } from './ui/app'
import { initTheme } from './ui/theme'

initTheme(document.querySelector<HTMLButtonElement>('#theme-toggle'))
startApp()
