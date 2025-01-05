// src/styles/challengeStyles.ts
import { ChallengeType } from '../challengeTypes';
import { Users, Globe, Target, UserPlus, Flame } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Define possible challenge states
export type ChallengeState = 'default' | 'completed' | 'disabled' | 'selected' | 'active';

interface StateStyles {
  bgColor: string;
  borderColor: string;
  textColor: string;
  opacity?: number;
}

interface ChallengeStyle {
  mainColor: string;      // Primary brand color for the challenge type
  icon: LucideIcon;       // Lucide icon component
  name: string;           // Display name
  description: string;    // Short description for tooltips/accessibility
  states: {
    default: StateStyles;
    completed: StateStyles;
    disabled: StateStyles;
    selected: StateStyles;
    active: StateStyles;
  };
}

type ChallengeStyleMap = {
  [key in ChallengeType]: ChallengeStyle;
};

export const challengeStyles: ChallengeStyleMap = {
  [ChallengeType.GROUP]: {
    mainColor: 'rgb(16, 185, 129)',
    icon: Users,
    name: 'Group Challenge',
    description: 'Collaborate with a group',
    states: {
      default: {
        bgColor: 'rgb(236, 253, 245)',
        borderColor: 'rgb(209, 250, 229)',
        textColor: 'rgb(6, 95, 70)'
      },
      completed: {
        bgColor: 'rgb(236, 253, 245)',
        borderColor: 'rgb(209, 250, 229)',
        textColor: 'rgb(6, 95, 70)',
        opacity: 0.6
      },
      disabled: {
        bgColor: 'rgb(243, 244, 246)',
        borderColor: 'rgb(229, 231, 235)',
        textColor: 'rgb(107, 114, 128)',
        opacity: 0.5
      },
      selected: {
        bgColor: 'rgb(16, 185, 129)',
        borderColor: 'rgb(16, 185, 129)',
        textColor: 'rgb(255, 255, 255)'
      },
      active: {
        bgColor: 'rgb(167, 243, 208)',
        borderColor: 'rgb(16, 185, 129)',
        textColor: 'rgb(6, 95, 70)'
      }
    }
  },
  [ChallengeType.PUBLIC]: {
    mainColor: 'rgb(239, 68, 68)',
    icon: Globe,
    name: 'Public Challenge',
    description: 'Open to everyone',
    states: {
      default: {
        bgColor: 'rgb(254, 242, 242)',
        borderColor: 'rgb(254, 226, 226)',
        textColor: 'rgb(153, 27, 27)'
      },
      completed: {
        bgColor: 'rgb(254, 242, 242)',
        borderColor: 'rgb(254, 226, 226)',
        textColor: 'rgb(153, 27, 27)',
        opacity: 0.6
      },
      disabled: {
        bgColor: 'rgb(243, 244, 246)',
        borderColor: 'rgb(229, 231, 235)',
        textColor: 'rgb(107, 114, 128)',
        opacity: 0.5
      },
      selected: {
        bgColor: 'rgb(239, 68, 68)',
        borderColor: 'rgb(239, 68, 68)',
        textColor: 'rgb(255, 255, 255)'
      },
      active: {
        bgColor: 'rgb(254, 202, 202)',
        borderColor: 'rgb(239, 68, 68)',
        textColor: 'rgb(153, 27, 27)'
      }
    }
  },
  [ChallengeType.PERSONAL]: {
    mainColor: 'rgb(139, 92, 246)',
    icon: Target,
    name: 'Personal Challenge',
    description: 'Your individual goal',
    states: {
      default: {
        bgColor: 'rgb(237, 233, 254)',
        borderColor: 'rgb(221, 214, 254)',
        textColor: 'rgb(76, 29, 149)'
      },
      completed: {
        bgColor: 'rgb(237, 233, 254)',
        borderColor: 'rgb(221, 214, 254)',
        textColor: 'rgb(76, 29, 149)',
        opacity: 0.6
      },
      disabled: {
        bgColor: 'rgb(243, 244, 246)',
        borderColor: 'rgb(229, 231, 235)',
        textColor: 'rgb(107, 114, 128)',
        opacity: 0.5
      },
      selected: {
        bgColor: 'rgb(139, 92, 246)',
        borderColor: 'rgb(139, 92, 246)',
        textColor: 'rgb(255, 255, 255)'
      },
      active: {
        bgColor: 'rgb(196, 181, 253)',
        borderColor: 'rgb(139, 92, 246)',
        textColor: 'rgb(76, 29, 149)'
      }
    }
  },
  [ChallengeType.FRIENDS]: {
    mainColor: 'rgb(59, 130, 246)',
    icon: UserPlus,
    name: 'Friend Challenge',
    description: 'Challenge with friends',
    states: {
      default: {
        bgColor: 'rgb(219, 234, 254)',
        borderColor: 'rgb(191, 219, 254)',
        textColor: 'rgb(30, 64, 175)'
      },
      completed: {
        bgColor: 'rgb(219, 234, 254)',
        borderColor: 'rgb(191, 219, 254)',
        textColor: 'rgb(30, 64, 175)',
        opacity: 0.6
      },
      disabled: {
        bgColor: 'rgb(243, 244, 246)',
        borderColor: 'rgb(229, 231, 235)',
        textColor: 'rgb(107, 114, 128)',
        opacity: 0.5
      },
      selected: {
        bgColor: 'rgb(59, 130, 246)',
        borderColor: 'rgb(59, 130, 246)',
        textColor: 'rgb(255, 255, 255)'
      },
      active: {
        bgColor: 'rgb(147, 197, 253)',
        borderColor: 'rgb(59, 130, 246)',
        textColor: 'rgb(30, 64, 175)'
      }
    }
  },
  [ChallengeType.DAILY]: {
    mainColor: 'rgb(249, 115, 22)',
    icon: Flame,
    name: 'Daily Challenge',
    description: 'Daily workout goals',
    states: {
      default: {
        bgColor: 'rgb(255, 237, 213)',
        borderColor: 'rgb(254, 215, 170)',
        textColor: 'rgb(154, 52, 18)'
      },
      completed: {
        bgColor: 'rgb(255, 237, 213)',
        borderColor: 'rgb(254, 215, 170)',
        textColor: 'rgb(154, 52, 18)',
        opacity: 0.6
      },
      disabled: {
        bgColor: 'rgb(243, 244, 246)',
        borderColor: 'rgb(229, 231, 235)',
        textColor: 'rgb(107, 114, 128)',
        opacity: 0.5
      },
      selected: {
        bgColor: 'rgb(249, 115, 22)',
        borderColor: 'rgb(249, 115, 22)',
        textColor: 'rgb(255, 255, 255)'
      },
      active: {
        bgColor: 'rgb(253, 186, 116)',
        borderColor: 'rgb(249, 115, 22)',
        textColor: 'rgb(154, 52, 18)'
      }
    }
  },
  [ChallengeType.NONE]: {
    mainColor: 'rgb(107, 114, 128)',
    icon: Target,
    name: 'Other',
    description: 'Miscellaneous challenge',
    states: {
      default: {
        bgColor: 'rgb(243, 244, 246)',
        borderColor: 'rgb(229, 231, 235)',
        textColor: 'rgb(55, 65, 81)'
      },
      completed: {
        bgColor: 'rgb(243, 244, 246)',
        borderColor: 'rgb(229, 231, 235)',
        textColor: 'rgb(55, 65, 81)',
        opacity: 0.6
      },
      disabled: {
        bgColor: 'rgb(243, 244, 246)',
        borderColor: 'rgb(229, 231, 235)',
        textColor: 'rgb(107, 114, 128)',
        opacity: 0.5
      },
      selected: {
        bgColor: 'rgb(107, 114, 128)',
        borderColor: 'rgb(107, 114, 128)',
        textColor: 'rgb(255, 255, 255)'
      },
      active: {
        bgColor: 'rgb(209, 213, 219)',
        borderColor: 'rgb(107, 114, 128)',
        textColor: 'rgb(55, 65, 81)'
      }
    }
  }
};

// Helper functions
export const getChallengeStyle = (
  type: ChallengeType | string | null | undefined,
  state: ChallengeState = 'default'
): ChallengeStyle & StateStyles => {
  const style = type && type in ChallengeType 
    ? challengeStyles[type as ChallengeType] 
    : challengeStyles[ChallengeType.NONE];

  return {
    ...style,
    ...style.states[state]
  };
};

// CSS class generator helper
export const getChallengeClassName = (
  type: ChallengeType | string | null | undefined,
  baseClass: string,
  state: ChallengeState = 'default'
): string => {
  const typeClass = type && type in ChallengeType 
    ? type.toLowerCase() 
    : 'none';
  
  return `${baseClass}--${typeClass} ${baseClass}--${state}`;
};

// Get inline styles for a challenge
export const getChallengeInlineStyles = (
  type: ChallengeType | string | null | undefined,
  state: ChallengeState = 'default'
): React.CSSProperties => {
  const style = getChallengeStyle(type, state);
  return {
    backgroundColor: style.states[state].bgColor,
    borderColor: style.states[state].borderColor,
    color: style.states[state].textColor,
    opacity: style.states[state].opacity,
  };
};
