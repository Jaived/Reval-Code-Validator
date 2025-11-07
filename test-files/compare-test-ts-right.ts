// Right TypeScript file
export class User {
  constructor(
    public name: string,
    public email: string,
    public age: number,
    public role: string = 'user'
  ) {}

  greet(): string {
    return `Hi, I am ${this.name} and I am ${this.age} years old`;
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
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

export function calculateDiscount(price: number, discount: number): number {
  return price * (1 - discount / 100);
}
