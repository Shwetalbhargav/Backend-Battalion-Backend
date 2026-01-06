import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, SigninDto } from './dto/register.dto';
import { UserRole, AuthMethod } from '../../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { email, password, role } = signupDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        authMethod: AuthMethod.EMAIL,
        isVerified: false,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    // Generate JWT token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return {
      user,
      access_token: token,
    };
  }

  async signin(signinDto: SigninDto) {
    const { email, password } = signinDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      access_token: token,
    };
  }

  async validateGoogleUser(googleUser: any, role?: UserRole) {
    const { googleId, email, firstName, lastName, picture } = googleUser;

    // Check if user exists by Google ID
    let user = await this.prisma.user.findUnique({
      where: { googleId },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    // If not found by Google ID, check by email
    if (!user && email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      // If user exists with email but no Google ID, link Google account
      if (existingUser && !existingUser.googleId) {
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            googleId,
            authMethod: AuthMethod.GOOGLE,
            // Auto-verify Google OAuth users (Google already verified them)
            isVerified: true,
          },
          select: {
            id: true,
            email: true,
            role: true,
            isVerified: true,
            isActive: true,
            createdAt: true,
          },
        });
      } else if (existingUser) {
        // User exists with Google ID already
        user = {
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role,
          isVerified: existingUser.isVerified,
          isActive: existingUser.isActive,
          createdAt: existingUser.createdAt,
        };
      }
    }

    // Create new user if doesn't exist
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          authMethod: AuthMethod.GOOGLE,
          role: role || UserRole.PATIENT,
          // Auto-verify Google OAuth users (Google already verified them)
          isVerified: true,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
        },
      });
    } else if (role && user.role !== role) {
      // If role is provided and different from current role, update it
      // Note: This allows users to change role on subsequent OAuth logins
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: role as UserRole },
        select: {
          id: true,
          email: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
        },
      });
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Generate JWT token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      access_token: token,
    };
  }
}
