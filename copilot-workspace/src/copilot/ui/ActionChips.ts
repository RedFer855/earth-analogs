import type { SimTelemetryAlertDetail, SimulationControlDetail, TargetBody } from '../types/copilot.types.ts';
import { button, el } from './dom.ts';

export interface ActionChip {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly control: SimulationControlDetail;
}

// What-If chips (plan section 5). Each sends a bare `whatIf` or `action`: the sandbox applies `whatIf` only to a
// message without an `analog` payload (nasa-3d-sandbox/src/bridge/sandboxDataBridge.ts, handleSimulationControl).
const MOON_CHIPS: readonly ActionChip[] = [
  {
    id: 'moon-psr',
    label: 'Dark crater (PSR, N6 = 0)',
    hint: 'Sets solar illumination to 0 and switches the 3D to LiDAR.',
    control: { mode: 'LIDAR_LANDER', whatIf: { variable: 'N6', newValue: 0 } },
  },
  {
    id: 'moon-slope',
    label: 'Slope 16° (beyond VIPER)',
    hint: 'Raises N1 past the VIPER 15° limit in rover mode.',
    control: { mode: 'ROVER', whatIf: { variable: 'N1', newValue: 16 } },
  },
  {
    id: 'moon-silica',
    label: 'High silica 70%',
    hint: 'Sets N4 to 70% SiO2 for suit abrasion.',
    control: { mode: 'SUIT_EDS', whatIf: { variable: 'N4', newValue: 70 } },
  },
];

const MARS_CHIPS: readonly ActionChip[] = [
  {
    id: 'mars-saltation',
    label: 'Dust storm (N7 = 0.65)',
    hint: 'Sets the saltation time fraction to 0.65 in suit mode.',
    control: { mode: 'SUIT_EDS', whatIf: { variable: 'N7', newValue: 0.65 } },
  },
  {
    id: 'mars-wob',
    label: 'Raise drill thrust (WOB)',
    hint: 'Boosts weight on bit from 100 N to 200 N.',
    control: { mode: 'ISRU_DRILL', action: 'BOOST_DRILL_WOB' },
  },
];

export function whatIfChips(body: TargetBody): readonly ActionChip[] {
  return body === 'MOON' ? MOON_CHIPS : MARS_CHIPS;
}

const ACTION_LABEL: Record<string, string> = {
  PULSE_EDS: 'Pulse the EDS',
  RESET_DUST: 'Reset dust',
  RETRACT_DRILL_BITE: 'Retract the bit 0.10 m',
  BOOST_DRILL_WOB: 'Raise drill thrust',
};

/** The one-click remedy for a 3D alert: the sandbox `suggestedAction`, or a copilot fallback by alert code. */
export function remedyFor(alert: SimTelemetryAlertDetail): ActionChip | null {
  if (alert.suggestedAction !== undefined && alert.suggestedAction in ACTION_LABEL) {
    return {
      id: `remedy-${alert.suggestedAction}`,
      label: ACTION_LABEL[alert.suggestedAction],
      hint: `Suggested by the 3D for ${alert.code}.`,
      control: { action: alert.suggestedAction },
    };
  }
  switch (alert.code) {
    case 'LIDAR_PSR_OPTICAL_BLIND':
      return {
        id: 'remedy-sunlight',
        label: 'Return to sunlight (N6 = 1)',
        hint: 'Optical LiDAR is blind in a PSR; restore illumination to compare.',
        control: { mode: 'LIDAR_LANDER', whatIf: { variable: 'N6', newValue: 1 } },
      };
    case 'SUIT_SOLAR_DEFICIT_PSR':
    case 'SUIT_MARS_SALTATION':
    case 'SUIT_SILICA_ABRASION':
      return { id: 'remedy-eds', label: ACTION_LABEL.PULSE_EDS, hint: 'Clears dust from the suit.', control: { action: 'PULSE_EDS' } };
    case 'DRILL_TORQUE_STALL':
    case 'DRILL_POWER_LIMIT':
      return { id: 'remedy-bite', label: ACTION_LABEL.RETRACT_DRILL_BITE, hint: 'Backs the bit off one bite.', control: { action: 'RETRACT_DRILL_BITE' } };
    default:
      return null;
  }
}

export function renderActionChips(
  container: HTMLElement,
  chips: readonly ActionChip[],
  onPick: (chip: ActionChip) => void,
): void {
  container.replaceChildren();
  for (const chip of chips) {
    const b = button('chip', chip.label, () => onPick(chip));
    b.title = chip.hint;
    container.append(b);
  }
  if (chips.length === 0) container.append(el('p', 'muted', 'Select a site to try What-If changes.'));
}
