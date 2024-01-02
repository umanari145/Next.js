import "@/styles/globals.css";
import { AppProps } from "../../node_modules/next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
