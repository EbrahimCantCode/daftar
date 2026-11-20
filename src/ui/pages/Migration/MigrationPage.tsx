import { useState } from 'preact/hooks';
import { downloadPreMigrationBackup, runMigration } from '../../../state/store';
import { Button } from '../../components/Button';
import { showToast } from '../../components/Toast';
import { TopBar } from '../../components/TopBar';

/** Shown once, when data from the month-based version is waiting to move to pay cycles. */
export function MigrationPage() {
  const [busy, setBusy] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  return (
    <div class="screen">
      <TopBar title="Daftar" />
      <section class="migration" aria-labelledby="migration-title">
        <h2 id="migration-title" class="section-title">
          Switching to pay cycles
        </h2>
        <p>
          Daftar now follows your salary instead of the calendar: a cycle runs from one payday to the day before the next (the 26th
          by default, which you can change in Settings).
        </p>
        <p>Nothing is deleted. Your entries stay as they are and are grouped into cycles by their dates.</p>
        <p class="hint">Download a backup first, so you have a copy of your notebook as it is now.</p>
        <div class="button-row">
          <Button
            icon="download"
            onClick={async () => {
              await downloadPreMigrationBackup();
              setBackedUp(true);
              showToast('Backup downloaded');
            }}
          >
            Download backup (CSV)
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await runMigration();
                showToast('Your notebook now uses pay cycles');
              } catch (err) {
                console.error(err);
                showToast('Could not update. Nothing was changed.');
                setBusy(false);
              }
            }}
          >
            {backedUp ? 'Update my notebook' : 'Update without backup'}
          </Button>
        </div>
      </section>
    </div>
  );
}
