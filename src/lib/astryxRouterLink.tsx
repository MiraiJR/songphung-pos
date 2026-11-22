import { forwardRef } from "react";
import { NavLink } from "react-router-dom";

type AstryxRouterLinkProps = {
  href?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  target?: string;
  rel?: string;
  download?: string | boolean;
  onClick?: React.MouseEventHandler;
};

/** Maps Astryx `href` → React Router `to` for HashRouter. */
export const AstryxRouterLink = forwardRef<HTMLAnchorElement, AstryxRouterLinkProps>(
  function AstryxRouterLink({ href = "/", ...rest }, ref) {
    return <NavLink ref={ref} to={href} {...rest} />;
  },
);
