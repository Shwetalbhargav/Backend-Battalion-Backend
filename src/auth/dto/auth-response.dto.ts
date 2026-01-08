import { AuthUserDto } from "./auth-user.dto"

export class AuthResponseDto {
  token: string;
  user: AuthUserDto;
}
