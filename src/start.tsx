import { App } from './App';

// The app and everything that reads the question bank. main.tsx loads this only once the bank is
// available, which on a locked site means after the password is entered.
export async function startApp() {
  return <App />;
}
