import { Container } from "@mantine/core";
import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** A content page: the site header, the page in the standard container, the site footer. */
export function PageShell({ children }: { children: ReactNode }) {
	return (
		<>
			<SiteHeader />
			<Container
				component="main"
				size="md"
				px={{ base: "sm", sm: "md" }}
				py="lg"
			>
				{children}
			</Container>
			<SiteFooter />
		</>
	);
}
