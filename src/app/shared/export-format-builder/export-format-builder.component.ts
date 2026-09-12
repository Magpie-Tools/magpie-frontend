import {HlmInput} from '@spartan-ng/helm/input';
import {Component, Input} from '@angular/core';
import {FormGroup, ReactiveFormsModule} from '@angular/forms';

@Component({
  selector: 'app-export-format-builder',
  standalone: true,
  imports: [HlmInput, ReactiveFormsModule],
  templateUrl: './export-format-builder.component.html',
  styleUrl: './export-format-builder.component.scss',
})
export class ExportFormatBuilderComponent {
  @Input({required: true}) form!: FormGroup;
  @Input() fields: readonly string[] = [];
  @Input() inputId = 'exportOutputFormat';

  addField(field: string): void {
    const control = this.form.get('output');
    if (!control) {
      return;
    }

    const current = typeof control.value === 'string' ? control.value : '';
    control.setValue(current ? `${current};${field}` : field);
    control.markAsDirty();
  }
}
