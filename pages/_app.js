import { AppStore } from '../store';

import './app.css';
import Head from 'next/head';

export default function MyApp({
  Component,
  pageProps,
}) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      <AppStore>
        <Component {...pageProps} />
      </AppStore>
    </>
  );
}