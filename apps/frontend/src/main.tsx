import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { AppStoreProvider } from '@/store';
import { defaultState } from '@/store/app-store';
import { QueryProvider } from './providers/query-provider';
import { AppRouterProvider } from './router';
import { installAudioOutputCapture } from '@/lib/audio-recorder';
import './index.css';

installAudioOutputCapture();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryProvider>
      <ReactFlowProvider>
        <AppStoreProvider initialState={{ ...defaultState }}>
          <AppRouterProvider />
        </AppStoreProvider>
      </ReactFlowProvider>
    </QueryProvider>
  </React.StrictMode>,
);
