import { Component, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { PanelModule } from 'primeng/panel';
import { Tree } from 'primeng/tree';
import { MessageService, TreeDragDropService, TreeNode } from 'primeng/api';
import { InputNumberModule } from 'primeng/inputnumber';
import { Toast } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';

import * as XLSX from 'xlsx';

@Component({
  selector: 'app-root',
  imports: [
    ButtonModule,
    FileUploadModule,
    TableModule,
    CardModule,
    PanelModule,
    Toast,
    Tree,
    InputNumberModule,
    ProgressBarModule,
    ReactiveFormsModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [TreeDragDropService, MessageService],
})
export class AppComponent {
  readonly examinerData = signal<any[]>([]);
  readonly examineeData = signal<any[]>([]);
  readonly standardizedClientData = signal<any[]>([]);
  readonly adminsTree = signal<TreeNode[]>([]);
  readonly generatedData = signal<any[]>([]);
  readonly form!: FormGroup;

  readonly uploadStatus = {
    examiner: { progress: 0, valid: false, error: '' },
    examinee: { progress: 0, valid: false, error: '' },
    standardizedClient: { progress: 0, valid: false, error: '' },
  };

  readonly showSchedule = signal(false);

  constructor(private fb: FormBuilder, private messageService: MessageService) {
    this.form = this.fb.group({
      adminCount: [0, [Validators.required, Validators.min(1)]],
      trackCount: [0, [Validators.required, Validators.min(1)]],
      stationCount: [0, [Validators.required, Validators.min(1)]],
    });
  }

  get f() {
    return this.form.controls;
  }

  /**
   * Returns the round number for an examinee based on index and total stations.
   */
  getRound(index: number): number {
    const stations = this.f['stationCount'].value;
    return Math.ceil(index / stations) + 1;
  }

  /**
   * Returns the station number for an examinee based on index and total stations.
   */
  getStation(index: number): number {
    const stations = this.f['stationCount'].value;
    return Math.floor(index % stations) + 1;
  }

  onNodeDrop(event: any) {
    this.messageService.add({
      severity: 'info',
      summary: 'Node Moved',
      detail: `Moved ${event.node?.label}`,
    });
  }

  generateTree(): TreeNode[] {
    const data = this.generatedData();
    if (this.generatedData() && this.generatedData().length > 0) {
      return data.map((admin) => ({
        label: admin.adminId,
        expanded: true,
        children: admin.tracks.map((track: any) => ({
          label: track.trackId,
          expanded: true,
          children: track.stations.map((station: any) => ({
            label: station,
            leaf: true,
          })),
        })),
      }));
    }

    return [];
  }

  generateStructure(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({
        severity: 'error',
        summary: 'Form Error',
        detail: 'Please fill all required fields correctly.',
      });
      return;
    }

    const adminCount = this.form.value.adminCount;
    const trackCount = this.form.value.trackCount;
    const stationCount = this.form.value.stationCount;

    const result = [];
    for (let i = 1; i <= adminCount; i++) {
      const tracks = [];
      for (let j = 1; j <= trackCount; j++) {
        const stations = [];
        for (let k = 1; k <= stationCount; k++) {
          stations.push(`station_${k}`);
        }
        tracks.push({ trackId: `track_${j}`, stations });
      }
      result.push({ adminId: `admin_${i}`, tracks });
    }

    this.generatedData.set(result);
    this.adminsTree.set(this.generateTree());
    this.messageService.add({
      severity: 'success',
      summary: 'Structure Generated',
      detail: 'Admin/Track/Station structure generated successfully.',
    });
  }

  onFileSelect(
    event: any,
    type: 'examiner' | 'examinee' | 'standardizedClient'
  ): void {
    const file = event.files?.[0];
    if (!file) return;

    this.uploadStatus[type].progress = 10;
    this.uploadStatus[type].error = '';
    this.uploadStatus[type].valid = false;

    const reader = new FileReader();

    reader.onload = ({ target }: any) => {
      this.uploadStatus[type].progress = 50;

      try {
        const data = new Uint8Array(target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        let jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true });

        if (!jsonData.length) throw new Error('Sheet is empty');

        jsonData = jsonData.map((row) => {
          const normalized: any = {};
          Object.entries(row).forEach(([key, value]) => {
            normalized[key.toLowerCase()] = value;
          });
          return normalized;
        });

        switch (type) {
          case 'examiner':
            this.examinerData.set(jsonData);
            break;
          case 'examinee':
            this.examineeData.set(jsonData);
            break;
          case 'standardizedClient':
            this.standardizedClientData.set(jsonData);
            break;
        }

        this.uploadStatus[type].valid = true;
        this.uploadStatus[type].progress = 100;
        this.messageService.add({
          severity: 'success',
          summary: 'Upload Success',
          detail: `${type} data uploaded successfully.`,
          life: 3000,
        });
      } catch (err: any) {
        this.uploadStatus[type].error = err.message || 'Invalid file format';
        this.uploadStatus[type].progress = 0;
        this.messageService.add({
          severity: 'error',
          summary: 'Upload Failed',
          detail: `${type} file error: ${err.message || 'Invalid file format'}`,
          life: 5000,
        });
      }
    };

    reader.readAsArrayBuffer(file);
  }
}
