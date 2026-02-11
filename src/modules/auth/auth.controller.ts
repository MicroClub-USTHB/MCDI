import { Controller, Get, Render, Query } from '@nestjs/common';

@Controller('auth')
export class AuthController {
    @Get('login')
    @Render('login')
    login(@Query('status') status: string) {
        return { status };
    }

    @Get('discord')
    discordLogin() {
        // Redirect to Discord OAuth
        return;
    }

    @Get('discord/callback')
    discordCallback() {
        // Handle callback
        // For now, mockup redirect
        return { url: '/api/auth/login?status=success' };
    }
}
