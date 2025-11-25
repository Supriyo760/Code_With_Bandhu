// src/components/Avatar.tsx
import { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';

interface AvatarProps {
  username: string;
  size?: number;
}

const Avatar = ({ username, size = 64 }: AvatarProps) => {
  const avatarDataUri = useMemo(() => {
    return createAvatar(lorelei, {
      seed: username,
      size,
      backgroundColor: ['f3e5f5', 'e1bee7', 'd1c4e9'],
      backgroundType: ['solid'],
      // optional tweaks for variety
      eyes: ['variant01', 'variant02', 'variant03', 'variant04'],
      mouth: (['happy01', 'happy02', 'surprised01'] as unknown) as unknown,
      hairAccessoriesProbability: 50,
    }).toDataUri();
  }, [username, size]);

  return (
    <img
      src={avatarDataUri}
      alt={`${username}'s avatar`}
      className="rounded-full border border-purple-400/20 shadow-md"
      style={{ width: size, height: size }}
    />
  );
};

export default Avatar;