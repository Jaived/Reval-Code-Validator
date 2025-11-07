// Left JavaScript file
function calculateTotal(items) {
  let total = 0;
  for (let item of items) {
    total += item.price;
  }
  return total;
}

function processData(data) {
  return data.map(x => x * 2);
}

const greeting = "Hello World";

const myArray = [1, 2, 3, 4, 5];

function uniqueFunction() {
  console.log("This is unique to left");
}
