import { validate } from "uuid";

export function isUUID(uuid: string): boolean {
	return validate(uuid);
}
