"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Iterator;
const Prompt_1 = require("../Prompt");
function Iterator(items, options) {
    const { iterations, collectionKey, collection } = options;
    let iterableCollection = [];
    if (collectionKey) {
        iterableCollection = [collectionKey];
    }
    else if (collection) {
        // Use the provided collection
        if (Array.isArray(collection)) {
            iterableCollection = collection;
        }
        else {
            throw new Error("Provided collection is not an array.");
        }
    }
    else if (iterations !== undefined) {
        // Create a collection based on the number of iterations
        iterableCollection = Array.from({ length: iterations }, (_, i) => i + 1);
    }
    else {
        throw new Error("Either iterations, collectionKey, or collection must be provided.");
    }
    const instantiatedItems = items.map((item) => {
        if ("name" in item && "content" in item) {
            return item;
        }
        else {
            const key = Object.keys(item)[0];
            // @ts-ignore
            const value = item[key];
            // @ts-ignore
            return (0, Prompt_1.createPrompt)({ name: key, content: value });
        }
    });
    const iteratedItems = [];
    iterableCollection.forEach((iterationValue, index) => {
        instantiatedItems.forEach((item) => {
            const newItem = (0, Prompt_1.createPrompt)(Object.assign(Object.assign({}, item), { name: `${item.name}_iteration_${index + 1}`, spice: {
                    iteration: index + 1,
                    iterationValue,
                } }));
            iteratedItems.push(newItem);
        });
    });
    return iteratedItems;
}
