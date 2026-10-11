import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource-variable/source-serif-4';
import './index.css';
import App from './App';
import { AppStoreProvider } from './store/AppStore';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AppStoreProvider>
      <App />
    </AppStoreProvider>
  </BrowserRouter>,
);
