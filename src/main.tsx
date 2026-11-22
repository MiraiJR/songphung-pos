import React from "react";
import ReactDOM from "react-dom/client";
// FIRST: declare cascade layers before any Astryx/theme CSS side-effects.
import "./index.css";
import { Theme } from "@astryxdesign/core/theme";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { LinkProvider } from "@astryxdesign/core/Link";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import viVN from "@astryxdesign/core/locales/vi-VN.generated.js";
import { themes, defaultThemeSlug } from "./astryx-themes";
import { AstryxRouterLink } from "./lib/astryxRouterLink";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <InternationalizationProvider locale="vi-VN" messages={{ "vi-VN": viVN }}>
      <Theme theme={themes[defaultThemeSlug]}>
        <LayerProvider toast={{ position: "bottomEnd" }}>
          <LinkProvider component={AstryxRouterLink}>
            <App />
          </LinkProvider>
        </LayerProvider>
      </Theme>
    </InternationalizationProvider>
  </React.StrictMode>,
);
