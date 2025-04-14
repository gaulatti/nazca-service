import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Earthquake } from 'src/models/earthquake.model';
import { BackupService } from './backup/backup.service';

@Module({
  imports: [SequelizeModule.forFeature([Earthquake])],
  exports: [SequelizeModule],
  providers: [BackupService],
})
export class DalModule {}
