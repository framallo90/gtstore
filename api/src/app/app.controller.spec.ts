import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;
  const appServiceMock = {
    getData: () => ({ message: 'Hello API' }),
    getHealth: async () => ({ status: 'ok' as const }),
  };

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appServiceMock }],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({ message: 'Hello API' });
    });
  });

  describe('getHealth', () => {
    it('should return status ok', async () => {
      const appController = app.get<AppController>(AppController);
      await expect(appController.getHealth()).resolves.toEqual({ status: 'ok' });
    });
  });
});
