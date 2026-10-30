import type { JSX } from 'react'

import type { ReportLanguage } from '../../domain/review-session.js'
import { reportLanguageNames, reportLanguageSchema } from '../../domain/review-session.js'
import { SelectList } from '../components/select-list.js'
import { StepFrame } from '../components/step-frame.js'

type LanguageStepProps = {
  value: ReportLanguage
  onSubmit: (language: ReportLanguage) => void
  onBack?: () => void
}

export const LanguageStep = ({ value, onSubmit, onBack }: LanguageStepProps): JSX.Element => (
  <StepFrame title="Report language" hints="↑↓ row · Enter confirm" onBack={onBack}>
    <SelectList
      items={reportLanguageSchema.options.map((language) => ({ key: language, label: reportLanguageNames[language] }))}
      initialKey={value}
      onSelect={(key) => onSubmit(reportLanguageSchema.parse(key))}
    />
  </StepFrame>
)
