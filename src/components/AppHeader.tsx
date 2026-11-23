import { useLocation } from "react-router-dom";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { AstryxRouterLink } from "@/lib/astryxRouterLink";
import { version } from "../../package.json";

const NAV_ITEMS = [
  { label: "POS", to: "/" },
  { label: "Phòng", to: "/admin/rooms" },
  { label: "Sản phẩm", to: "/admin/products" },
  { label: "Nhóm Sản phẩm", to: "/admin/categories" },
  { label: "Lịch sử", to: "/admin/history" },
  { label: "Thống kê", to: "/admin/stats" },
  { label: "Cài đặt", to: "/admin/settings" },
] as const;

export function AppHeader() {
  const location = useLocation();

  return (
    <TopNav
      label="Điều hướng Song Phụng"
      heading={
        <TopNavHeading
          heading="Song Phụng"
          headingHref="/"
          as={AstryxRouterLink}
          logo={
            <img
              src="/logo.png"
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: 6 }}
            />
          }
          headerEndContent={
            <Text size="sm" color="secondary">
              v{version}
            </Text>
          }
        />
      }
      endContent={
        <HStack gap={1} vAlign="center">
          {NAV_ITEMS.map((item) => (
            <TopNavItem
              key={item.to}
              label={item.label}
              href={item.to}
              as={AstryxRouterLink}
              isSelected={location.pathname === item.to}
            />
          ))}
        </HStack>
      }
    />
  );
}
