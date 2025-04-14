import { Controller, Post, Get, Body } from '@nestjs/common';
import { EarthquakeService } from './earthquake.service';

interface RegisterEarthquakeDto {
  sourceId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depth?: number;
  additionalData?: Record<string, any>;
}

@Controller()
export class EarthquakeController {
  constructor(private readonly earthquakeService: EarthquakeService) {}

  @Get()
  async list() {
    return this.earthquakeService.list();
  }

  @Post('register')
  async register(@Body() data: RegisterEarthquakeDto) {
    return this.earthquakeService.register(data);
  }
}
