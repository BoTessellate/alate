import '@canva/app-ui-kit/styles.css';
import { createRoot } from 'react-dom/client';
import { AppUiProvider } from '@canva/app-ui-kit';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(
  <AppUiProvider>
    <App />
  </AppUiProvider>
);
