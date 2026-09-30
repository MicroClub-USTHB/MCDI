import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AdminProfileService } from './admin-profile.service';
import { MemberRepository } from '../repositories/member.repository';

const member = {
  id: 'admin-1',
  username: 'johndoe',
  globalName: 'John Doe',
  displayName: 'John',
  preferredName: null as string | null,
  avatar: 'hash',
  email: 'john@example.com',
  isSystemAdmin: true,
};

describe('AdminProfileService', () => {
  let service: AdminProfileService;
  let repo: { findById: jest.Mock; setPreferredName: jest.Mock };

  beforeEach(async () => {
    repo = {
      findById: jest.fn().mockResolvedValue(member),
      setPreferredName: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminProfileService,
        { provide: MemberRepository, useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(AdminProfileService);
  });

  describe('getProfile', () => {
    it('maps the member row to the response shape', async () => {
      await expect(service.getProfile('admin-1')).resolves.toEqual({
        id: 'admin-1',
        username: 'johndoe',
        globalName: 'John Doe',
        displayName: 'John',
        preferredName: null,
        avatar: 'hash',
        email: 'john@example.com',
        isSystemAdmin: true,
      });
    });

    it('throws when the member is gone', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getProfile('admin-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('does nothing when preferredName is absent', async () => {
      await service.updateProfile('admin-1', {});
      expect(repo.setPreferredName).not.toHaveBeenCalled();
      expect(repo.findById).toHaveBeenCalledWith('admin-1');
    });

    it('trims and stores a provided name', async () => {
      repo.setPreferredName.mockResolvedValue({
        ...member,
        preferredName: 'J. Doe',
      });
      const res = await service.updateProfile('admin-1', {
        preferredName: '  J. Doe  ',
      });
      expect(repo.setPreferredName).toHaveBeenCalledWith('admin-1', 'J. Doe');
      expect(res.preferredName).toBe('J. Doe');
    });

    it('clears the override on explicit null', async () => {
      repo.setPreferredName.mockResolvedValue({
        ...member,
        preferredName: null,
      });
      await service.updateProfile('admin-1', { preferredName: null });
      expect(repo.setPreferredName).toHaveBeenCalledWith('admin-1', null);
    });

    it('clears the override when only whitespace is sent', async () => {
      repo.setPreferredName.mockResolvedValue({
        ...member,
        preferredName: null,
      });
      await service.updateProfile('admin-1', { preferredName: '   ' });
      expect(repo.setPreferredName).toHaveBeenCalledWith('admin-1', null);
    });
  });
});
