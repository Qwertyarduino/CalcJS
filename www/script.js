"use strict";

const display = document.getElementById("display");
const previous = document.getElementById("previous");
const error = document.getElementById("error");
const angleButton = document.getElementById("angleMode");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");

let expression = "";
let angleMode = "DEG";
let justCalculated = false;
let history = [];

const constants = {
    pi: Math.PI,
    e: Math.E
};

function toRadians(x) {
    return angleMode === "DEG" ? x * Math.PI / 180 : x;
}

function fromRadians(x) {
    return angleMode === "DEG" ? x * 180 / Math.PI : x;
}

const functions = {
    sin: x => Math.sin(toRadians(x)),
    cos: x => Math.cos(toRadians(x)),

    tan: x => {
        const r = toRadians(x);

        if (Math.abs(Math.cos(r)) < 1e-12) {
            throw Error("Tangent is undefined here");
        }

        return Math.tan(r);
    },

    asin: x => fromRadians(Math.asin(x)),
    acos: x => fromRadians(Math.acos(x)),
    atan: x => fromRadians(Math.atan(x)),

    sqrt: x => {
        if (x < 0) throw Error("Invalid square root");
        return Math.sqrt(x);
    },

    log: x => {
        if (x <= 0) throw Error("log requires a positive number");
        return Math.log10(x);
    },

    ln: x => {
        if (x <= 0) throw Error("ln requires a positive number");
        return Math.log(x);
    }
};

function tokenize(input) {
    const tokens = [];
    let i = 0;

    while (i < input.length) {
        const rest = input.slice(i);

        if (/\s/.test(input[i])) {
            i++;
            continue;
        }

        const number = rest.match(
            /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i
        );

        if (number) {
            tokens.push({
                type: "number",
                value: Number(number[0])
            });

            i += number[0].length;
            continue;
        }

        const name = rest.match(/^[a-zA-Z]+/);

        if (name) {
            tokens.push({
                type: "name",
                value: name[0].toLowerCase()
            });

            i += name[0].length;
            continue;
        }

        if ("+-*/^()%".includes(input[i])) {
            tokens.push({
                type: input[i],
                value: input[i]
            });

            i++;
            continue;
        }

        throw Error("Unsupported character");
    }

    return tokens;
}

function calculate(input) {
    const tokens = tokenize(input);
    let pos = 0;

    const peek = () => tokens[pos];

    function take(type) {
        if (!peek() || peek().type !== type) {
            throw Error("Check parentheses or expression");
        }

        return tokens[pos++];
    }

    function primary() {
        const t = peek();

        if (!t) throw Error("Incomplete expression");

        if (t.type === "+") {
            pos++;
            return primary();
        }

        if (t.type === "-") {
            pos++;
            return -primary();
        }

        if (t.type === "number") {
            pos++;
            return t.value;
        }

        if (t.type === "(") {
            pos++;
            const value = addSub();
            take(")");
            return value;
        }

        if (t.type === "name") {
            pos++;

            if (Object.hasOwn(constants, t.value)) {
                return constants[t.value];
            }

            if (!Object.hasOwn(functions, t.value)) {
                throw Error("Unknown function or constant");
            }

            take("(");
            const argument = addSub();
            take(")");

            return functions[t.value](argument);
        }

        throw Error("Invalid expression");
    }

    function postfix() {
        let value = primary();

        while (peek() && peek().type === "%") {
            pos++;
            value /= 100;
        }

        return value;
    }

    function power() {
        const left = postfix();

        if (peek() && peek().type === "^") {
            pos++;
            return Math.pow(left, power());
        }

        return left;
    }

    function multiplyDivide() {
        let value = power();

        while (
            peek() &&
            (peek().type === "*" || peek().type === "/")
        ) {
            const op = tokens[pos++].type;
            const right = power();

            if (op === "/" && right === 0) {
                throw Error("Cannot divide by zero");
            }

            value = op === "*" ? value * right : value / right;
        }

        return value;
    }

    function addSub() {
        let value = multiplyDivide();

        while (
            peek() &&
            (peek().type === "+" || peek().type === "-")
        ) {
            const op = tokens[pos++].type;
            const right = multiplyDivide();

            value = op === "+" ? value + right : value - right;
        }

        return value;
    }

    if (!tokens.length) throw Error("Enter a calculation");

    const result = addSub();

    if (pos !== tokens.length) {
        throw Error("Check the expression");
    }

    if (!Number.isFinite(result)) {
        throw Error("Result is outside the supported range");
    }

    return Object.is(result, -0) ? 0 : result;
}

function format(value) {
    if (Number.isInteger(value) && Math.abs(value) < 1e15) {
        return String(value);
    }

    return Number(value.toPrecision(12)).toString();
}

function render() {
    display.textContent = expression || "0";
}

function insert(value) {
    error.textContent = "";

    if (justCalculated && /[0-9.(a-z]/i.test(value)) {
        expression = "";
    }

    justCalculated = false;
    expression += value;
    render();
}

function clear() {
    expression = "";
    justCalculated = false;
    error.textContent = "";
    previous.textContent = "";
    render();
}

function evaluate() {
    if (!expression.trim()) return;

    const original = expression;

    try {
        const result = format(calculate(expression));

        history.unshift({
            expression: original,
            result
        });

        history = history.slice(0, 50);

        previous.textContent = original + " =";
        expression = result;
        justCalculated = true;
        error.textContent = "";

        render();
        renderHistory();
    } catch (e) {
        error.textContent = e.message || "Invalid expression";
    }
}

function renderHistory() {
    historyList.replaceChildren();

    if (!history.length) {
        historyList.textContent = "No calculations yet.";
        return;
    }

    history.forEach(item => {
        const button = document.createElement("button");
        button.className = "history-item";
        button.textContent =
            item.expression + " = " + item.result;

        button.addEventListener("click", () => {
            expression = item.result;
            justCalculated = true;
            render();
            historyPanel.hidden = true;
        });

        historyList.appendChild(button);
    });
}

document.querySelector(".keypad").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.value !== undefined) {
        insert(button.dataset.value);
        return;
    }

    switch (button.dataset.action) {
        case "clear":
            clear();
            break;

        case "backspace":
            expression = expression.slice(0, -1);
            justCalculated = false;
            error.textContent = "";
            render();
            break;

        case "equals":
            evaluate();
            break;

        case "history":
            historyPanel.hidden = !historyPanel.hidden;
            renderHistory();
            break;
    }
});

angleButton.addEventListener("click", () => {
    angleMode = angleMode === "DEG" ? "RAD" : "DEG";
    angleButton.textContent = angleMode;
    error.textContent = "Angle mode: " + angleMode;
});

document.getElementById("clearHistory").addEventListener("click", () => {
    history = [];
    renderHistory();
});

document.addEventListener("keydown", event => {
    if (/^[0-9.+\-*/^()%]$/.test(event.key)) {
        insert(event.key);
    } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        evaluate();
    } else if (event.key === "Backspace") {
        expression = expression.slice(0, -1);
        render();
    } else if (event.key === "Escape") {
        clear();
    }
});

render();