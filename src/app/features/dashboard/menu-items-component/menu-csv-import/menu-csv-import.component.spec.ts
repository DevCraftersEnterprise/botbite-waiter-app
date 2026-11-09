import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';
import { MenuImportPreview } from '../../../../core/services/types/menu-csv.types';
import { MenuCsvImportComponent } from './menu-csv-import.component';

describe('MenuCsvImportComponent', () => {
  const api = environment.apiBaseUrl;
  let fixture: ComponentFixture<MenuCsvImportComponent>;
  let backend: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;

  const preview = (overrides: Partial<MenuImportPreview> = {}): MenuImportPreview => ({
    summary: {
      rows: 1,
      categoriesToCreate: 1,
      productsToCreate: 1,
      productsToAdd: 0,
      productsToUpdate: 0,
      photosToCopy: 1,
    },
    categoriesToCreate: ['ROLLOS'],
    rows: [
      {
        row: 2,
        name: 'ROLL CALIFORNIA',
        category: 'ROLLOS',
        price: 120,
        action: 'create',
        photo: 'copy',
      },
    ],
    errors: [],
    warnings: [],
    ...overrides,
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const confirmButton = () => element().querySelector<HTMLButtonElement>('.modal-save-button')!;

  const chooseFile = async () => {
    const input = element().querySelector<HTMLInputElement>('input[type=file]')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['nombre,categoria,precio\n'], 'menu.csv', { type: 'text/csv' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };

  const answerPreview = async (body: MenuImportPreview) => {
    backend.expectOne(`${api}/menus/menu/menu-1/import/preview`).flush(body);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [MenuCsvImportComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MenuCsvImportComponent);
    fixture.componentRef.setInput('menuId', 'menu-1');
    fixture.componentRef.setInput('isOpen', true);
    await fixture.whenStable();
  });

  afterEach(() => backend.verify());

  it('shows the preview and imports only after confirming', async () => {
    const imported = jasmine.createSpy('imported');
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.imported.subscribe(imported);
    fixture.componentInstance.closed.subscribe(closed);

    expect(confirmButton().disabled).toBeTrue();

    await chooseFile();
    await answerPreview(preview());

    const text = element().textContent ?? '';
    expect(text).toContain('1 producto nuevo');
    expect(text).toContain('Categorías nuevas: ROLLOS');
    expect(text).toContain('ROLL CALIFORNIA');
    expect(text).toContain('con foto');
    expect(confirmButton().disabled).toBeFalse();

    confirmButton().click();
    backend.expectOne(`${api}/menus/menu/menu-1/import`).flush({
      message: 'Menú importado',
      summary: preview().summary,
      warnings: [],
      photoErrors: [],
    });
    await fixture.whenStable();

    expect(toastr.success).toHaveBeenCalledWith('Menú importado');
    expect(imported).toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
  });

  it('lists the errors by row and column and does not let you import', async () => {
    await chooseFile();
    await answerPreview(
      preview({
        rows: [],
        errors: [{ row: 3, column: 'precio', message: 'No es un precio válido.' }],
      })
    );

    expect(element().textContent).toContain('Fila 3 · Precio: No es un precio válido.');
    expect(confirmButton().disabled).toBeTrue();
  });

  it('keeps the modal open to list the photos that were not copied', async () => {
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.closed.subscribe(closed);

    await chooseFile();
    await answerPreview(preview());

    confirmButton().click();
    backend.expectOne(`${api}/menus/menu/menu-1/import`).flush({
      message: 'Menú importado',
      summary: preview().summary,
      warnings: [],
      photoErrors: [{ row: 2, column: 'foto_url', message: 'No se pudo copiar la foto.' }],
    });
    await fixture.whenStable();

    expect(element().textContent).toContain('1 foto no se pudo copiar');
    expect(confirmButton().textContent).toContain('Cerrar');
    expect(closed).not.toHaveBeenCalled();
  });

  it('shows the errors the import found if the menu changed', async () => {
    await chooseFile();
    await answerPreview(preview());

    confirmButton().click();
    backend.expectOne(`${api}/menus/menu/menu-1/import`).flush(
      {
        message: 'El archivo tiene errores y no se guardó nada.',
        errors: [{ row: 2, column: 'nombre', message: 'Este producto ya viene en la fila 1.' }],
      },
      { status: 400, statusText: 'Bad Request' }
    );
    await fixture.whenStable();

    expect(toastr.error).toHaveBeenCalledWith('El archivo tiene errores y no se guardó nada.');
    expect(element().textContent).toContain('Fila 2 · Nombre');
    expect(confirmButton().disabled).toBeTrue();
  });
});
