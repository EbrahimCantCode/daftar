import { goalHeatValue, settings, streak, todaySpentFils } from '../state/store';
import { Amount } from './Amount';
import { Icon } from './Icon';

function streakText(current: number, best: number, todayUnder: boolean): string {
  const bestNote = best > current ? ` · best ${best}` : '';
  if (!todayUnder) return (current > 0 ? `${current}-day streak ends today` : 'Over today') + bestNote;
  return (current > 0 ? `${current}-day streak` : 'Start a streak today') + bestNote;
}

/** Today's spending against the daily goal, with the current streak. */
export function TodayGoal() {
  const goal = settings.value.dailyGoalFils;
  const s = streak.value;
  if (!goal || !s) return null;
  const spent = todaySpentFils.value;
  const heat = goalHeatValue.value;
  const over = spent - goal;

  return (
    <section class="today-goal" style={{ '--heat': `${Math.round(heat * 100)}%` }} aria-label="Today against your daily goal">
      <div class="tg-row">
        <span class="tg-bar" style={{ width: `calc(${heat * 100}% - 0.25rem)` }} aria-hidden="true" />
        <span class="tg-label">Today</span>
        {over > 0 ? (
          <span class="tg-amount ink-red">
            <Amount fils={over} /> over
          </span>
        ) : (
          <span class="tg-amount">
            <Amount fils={spent} unit={false} />
            <span class="tg-of"> of </span>
            <Amount fils={goal} class="tg-goal" />
          </span>
        )}
      </div>
      <p class={`tg-streak${s.current > 0 && s.todayUnder ? ' is-lit' : ''}`}>
        <Icon name="flame" />
        <span class="tg-streak-text">{streakText(s.current, s.best, s.todayUnder)}</span>
      </p>
    </section>
  );
}
