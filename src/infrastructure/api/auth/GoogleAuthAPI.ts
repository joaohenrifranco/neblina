import type { OAuthDTO } from "@/domain/entities/Account";
import type { IAuthAPI } from "@/infrastructure/api/auth/IAuthAPI";
import { LoggerService } from "@/infrastructure/services/LoggerService";

export class GoogleAuthAPI implements IAuthAPI {
	static type: "gdrive" = "gdrive";
	private static readonly logger = LoggerService.create("GoogleAuthAPI");

	static async init() {
		await Promise.all([
			GoogleAuthAPI.loadGapiGlobals(),
			GoogleAuthAPI.loadGsiGlobals(),
		]);

		GoogleAuthAPI.logger.info("Google API loaded");

		if (!google || !google.accounts || !google.accounts.oauth2) {
			GoogleAuthAPI.logger.error("Google API not loaded");
			throw new Error("Google API not loaded");
		}
	}

	async revoke(oauthDto: OAuthDTO): Promise<void> {
		return new Promise((resolve) => {
			google.accounts.oauth2.revoke(oauthDto.accessToken, () => {
				resolve();
			});
		});
	}

	async authenticate(): Promise<OAuthDTO> {
		const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
		if (!clientId) {
			throw new Error("VITE_GOOGLE_CLIENT_ID environment variable is not set");
		}

		const tokenResponse =
			await new Promise<google.accounts.oauth2.TokenResponse>((resolve) => {
				const tokenClient = google.accounts.oauth2.initTokenClient({
					client_id: clientId,
					scope:
						"https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
					prompt: "consent",
					callback: resolve,
				});

				tokenClient.requestAccessToken();
			});

		const userInfo = await this.getUserInfo(tokenResponse.access_token);

		return {
			accessToken: tokenResponse.access_token,
			expiresAt: new Date(
				Date.now() + parseInt(tokenResponse.expires_in, 10) * 1000,
			).toISOString(),
			...userInfo,
		};
	}

	private async getUserInfo(accessToken: string) {
		const response = await fetch(
			"https://www.googleapis.com/oauth2/v2/userinfo",
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Failed to get user info: ${response.status} ${response.statusText}. ${errorText}`,
			);
		}

		const userInfo = await response.json();
		return {
			email: userInfo.email,
			name: userInfo.name,
			id: userInfo.id,
		};
	}

	private static loadGapiGlobals(): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "https://apis.google.com/js/api.js";
			script.onload = () => {
				gapi.load("client", async () => {
					try {
						await gapi.client.init({
							discoveryDocs: [
								"https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
							],
						});
						resolve();
					} catch (error) {
						reject(error);
					}
				});
			};
			script.onerror = () => {
				reject(new Error("Failed to load Google API script"));
			};
			document.head.appendChild(script);
		});
	}

	private static loadGsiGlobals(): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "https://accounts.google.com/gsi/client";
			script.async = true;
			script.defer = true;
			script.onload = () => {
				resolve();
			};
			script.onerror = () => {
				reject(new Error("Failed to load Google Identity Services script"));
			};
			document.head.appendChild(script);
		});
	}
}
