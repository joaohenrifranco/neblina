import { cva, type VariantProps } from "class-variance-authority";

export { default as Breadcrumb } from "./Breadcrumb.vue";
export { default as BreadcrumbItem } from "./BreadcrumbItem.vue";
export { default as BreadcrumbLink } from "./BreadcrumbLink.vue";
export { default as BreadcrumbList } from "./BreadcrumbList.vue";
export { default as BreadcrumbPage } from "./BreadcrumbPage.vue";
export { default as BreadcrumbSeparator } from "./BreadcrumbSeparator.vue";

export const breadcrumbVariants = cva(
	"flex items-center space-x-1 break-words text-sm text-muted-foreground",
);

export const breadcrumbItemVariants = cva("inline-flex items-center gap-1.5");

export const breadcrumbLinkVariants = cva(
	"transition-colors hover:text-foreground",
);

export const breadcrumbPageVariants = cva("font-normal text-foreground");

export const breadcrumbSeparatorVariants = cva("[&>svg]:size-3.5");

export type BreadcrumbVariants = VariantProps<typeof breadcrumbVariants>;
export type BreadcrumbItemVariants = VariantProps<
	typeof breadcrumbItemVariants
>;
export type BreadcrumbLinkVariants = VariantProps<
	typeof breadcrumbLinkVariants
>;
export type BreadcrumbPageVariants = VariantProps<
	typeof breadcrumbPageVariants
>;
export type BreadcrumbSeparatorVariants = VariantProps<
	typeof breadcrumbSeparatorVariants
>;
