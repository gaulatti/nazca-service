import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreationAttributes, Op } from 'sequelize';
import { Earthquake } from '../models/earthquake.model';

interface RegisterEarthquakeDto extends CreationAttributes<Earthquake> {
  sourceId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depth?: number;
  additionalData?: Record<string, any>;
}

@Injectable()
export class EarthquakeService {
  // Default time window in minutes and distance threshold in kilometers
  private readonly TIME_WINDOW_MINUTES = 10;
  private readonly DISTANCE_THRESHOLD_KM = 50;
  private readonly EARTH_RADIUS_KM = 6371;

  constructor(
    @InjectModel(Earthquake)
    private earthquakeModel: typeof Earthquake,
  ) {}

  private calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  async list(last24Hours = false): Promise<Earthquake[]> {
    if (last24Hours) {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      return this.earthquakeModel.findAll({
        where: {
          timestamp: {
            [Op.gte]: oneDayAgo,
          },
        },
        order: [['timestamp', 'DESC']],
      });
    }

    return this.earthquakeModel.findAll({
      order: [['timestamp', 'DESC']],
    });
  }

  async register(data: RegisterEarthquakeDto): Promise<Earthquake> {
    const timestamp = new Date(data.timestamp);
    const timeWindow = new Date(
      timestamp.getTime() - this.TIME_WINDOW_MINUTES * 60 * 1000,
    );

    // Find potential duplicates within the time window
    const potentialDuplicates = await this.earthquakeModel.findAll({
      where: {
        timestamp: {
          [Op.between]: [timeWindow, timestamp],
        },
      },
    });

    // Check for spatial proximity
    const duplicate = potentialDuplicates.find((eq) => {
      const distance = this.calculateHaversineDistance(
        data.latitude,
        data.longitude,
        eq.latitude,
        eq.longitude,
      );
      return distance <= this.DISTANCE_THRESHOLD_KM;
    });

    if (duplicate) {
      // Update existing record if new magnitude is larger or merge additional data
      if (data.magnitude > duplicate.magnitude) {
        duplicate.magnitude = data.magnitude;
      }
      if (data.depth !== undefined) {
        duplicate.depth = data.depth;
      }
      if (data.additionalData) {
        duplicate.additionalData = {
          ...duplicate.additionalData,
          ...data.additionalData,
        };
      }
      await duplicate.save();
      return duplicate;
    }

    // Create new record if no duplicate found
    return this.earthquakeModel.create(data);
  }
}
