import {Component, Input} from '@angular/core';
import {FormGroup, ReactiveFormsModule} from '@angular/forms';
import {InputTextModule} from 'primeng/inputtext';

@Component({
  selector: 'app-export-format-builder',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextModule],
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
