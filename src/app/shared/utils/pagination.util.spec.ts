import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createPaginationState } from './pagination.util';

describe('createPaginationState', () => {
  const selectEvent = (value: string) => ({ target: { value } }) as unknown as Event;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  const create = (total: number, config: Parameters<typeof createPaginationState>[1] = {}) => {
    const totalSignal = signal(total);
    const state = TestBed.runInInjectionContext(() => createPaginationState(totalSignal, config));
    TestBed.tick();
    return { totalSignal, state };
  };

  it('starts on the first page', () => {
    const { state } = create(25);

    expect(state.pageFrom()).toBe(1);
    expect(state.pageTo()).toBe(10);
    expect(state.canPrev()).toBeFalse();
    expect(state.canNext()).toBeTrue();
  });

  it('shows 0 to 0 with no results', () => {
    const { state } = create(0);

    expect(state.pageFrom()).toBe(0);
    expect(state.pageTo()).toBe(0);
    expect(state.canNext()).toBeFalse();
  });

  it('moves between pages without leaving the range', () => {
    const onChange = jasmine.createSpy('onChange');
    const { state } = create(25, { onChange });

    state.nextPage();
    state.nextPage();
    expect(state.pageFrom()).toBe(21);
    expect(state.pageTo()).toBe(25);
    expect(state.canNext()).toBeFalse();

    state.nextPage();
    expect(state.pagination().offset).toBe(20);

    state.prevPage();
    state.prevPage();
    state.prevPage();
    expect(state.pagination().offset).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('goes back to the first page when the page size changes', () => {
    const onChange = jasmine.createSpy('onChange');
    const { state } = create(100, { onChange });
    state.nextPage();

    state.changeLimit(selectEvent('25'));

    expect(state.pagination()).toEqual({ limit: 25, offset: 0 });
    expect(state.pageTo()).toBe(25);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('resets to the first page without notifying', () => {
    const onChange = jasmine.createSpy('onChange');
    const { state } = create(50, { onChange });
    state.nextPage();
    onChange.calls.reset();

    state.resetToFirstPage();

    expect(state.pagination().offset).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the previous total while loading', () => {
    const loading = signal(false);
    const { totalSignal, state } = create(30, { loading });

    loading.set(true);
    totalSignal.set(5);
    TestBed.tick();
    expect(state.stableTotal()).toBe(30);

    loading.set(false);
    TestBed.tick();
    expect(state.stableTotal()).toBe(5);
  });
});
