// Left TypeScript file
export class User {
  constructor(
    public name: string,
    public email: string,
    public age: number
  ) {}

  greet(): string {
    return `Hello, my name is ${this.name}`;
  }
}

export class Product {
  constructor(
    public id: number,
    public name: string,
    public price: number
  ) {}

  getDisplayPrice(): string {
    return `$${this.price.toFixed(2)}`;
  }
}

export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}
