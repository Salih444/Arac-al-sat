import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MusteriComponent } from './musteri';

describe('MusteriComponent', () => {
  let component: MusteriComponent;
  let fixture: ComponentFixture<MusteriComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MusteriComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MusteriComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
