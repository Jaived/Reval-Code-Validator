// Right JavaScript file
function calculateTotal(items) {
  let sum = 0;
  items.forEach(item => {
    sum += item.price;
  });
  return sum;
}

function processData(data) {
  return data.map(x => x * 2);
}

const greeting = "Hi There";

const myArray = [1, 2, 3, 4, 5, 6];

function anotherUniqueFunction() {
  console.log("This is unique to right");
}
