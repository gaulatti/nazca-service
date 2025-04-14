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
  private readonly MAGNITUDE_DIFFERENCE_THRESHOLD = 1.0; // Reduced from 2.0
  private readonly CLOSE_TIME_THRESHOLD = 2; // Events within 2 minutes are "very close in time"
  private readonly SPATIAL_THRESHOLD_MODIFIER = 0.7; // Reduce spatial threshold for events close in time

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

  private isDuplicateEvent(
    newEvent: RegisterEarthquakeDto,
    existingEvent: Earthquake,
    timeDifferenceMinutes: number,
  ): boolean {
    // Calculate spatial distance
    const distance = this.calculateHaversineDistance(
      newEvent.latitude,
      newEvent.longitude,
      existingEvent.latitude,
      existingEvent.longitude,
    );

    // Calculate magnitude difference
    const magnitudeDiff = Math.abs(
      newEvent.magnitude - existingEvent.magnitude,
    );

    // Adjust spatial threshold based on time proximity
    const adjustedSpatialThreshold =
      timeDifferenceMinutes <= this.CLOSE_TIME_THRESHOLD
        ? this.DISTANCE_THRESHOLD_KM * this.SPATIAL_THRESHOLD_MODIFIER
        : this.DISTANCE_THRESHOLD_KM;

    // More strict magnitude comparison for events very close in time
    if (timeDifferenceMinutes <= this.CLOSE_TIME_THRESHOLD) {
      return (
        distance <= adjustedSpatialThreshold &&
        magnitudeDiff <= this.MAGNITUDE_DIFFERENCE_THRESHOLD
      );
    }

    // For events further apart in time, be more lenient with magnitude differences
    // but stricter with location if magnitudes are very different
    if (magnitudeDiff > this.MAGNITUDE_DIFFERENCE_THRESHOLD) {
      return distance <= adjustedSpatialThreshold * 0.5; // Much stricter spatial requirement
    }

    return distance <= adjustedSpatialThreshold;
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

    // Check for duplicates with new logic
    const duplicate = potentialDuplicates.find((eq) => {
      const timeDiffMinutes = Math.abs(
        (timestamp.getTime() - new Date(eq.timestamp).getTime()) / (1000 * 60),
      );
      return this.isDuplicateEvent(data, eq, timeDiffMinutes);
    });

    if (duplicate) {
      // Only update if the new magnitude is larger
      if (data.magnitude > duplicate.magnitude) {
        duplicate.magnitude = data.magnitude;
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
      return duplicate; // Return existing record without updating if magnitude is smaller
    }

    // Create new record if no duplicate found or magnitude difference is too large
    return this.earthquakeModel.create(data);
  }
}
