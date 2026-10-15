import { Banner } from '@/components/ui';

/** Honest pilot banner for seed/read-only admin directories. */
export function DemoOnlyBanner({ noun = 'directory' }: { noun?: string }) {
  return (
    <Banner variant="info">
      Pilot {noun}: seeded data is view-only here. Full create/edit ships with admin CRUD.
    </Banner>
  );
}
