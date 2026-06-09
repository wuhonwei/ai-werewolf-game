import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { ensureLoggedIn } from './utils/auth';
import './app.scss';

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    void ensureLoggedIn().catch(() => {
      // Login retried on first API call
    });
  });

  return children;
}

export default App;
