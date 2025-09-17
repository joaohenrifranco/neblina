import type { OAuthDTO } from "@/domain/entities/Account";

export type IAuthAPI = {
	authenticate(): Promise<OAuthDTO>;
	revoke(oauthDto: OAuthDTO): Promise<void>;
};
