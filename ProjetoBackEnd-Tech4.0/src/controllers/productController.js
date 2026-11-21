const productService = require("../services/productService");
const productWriteService = require("../services/productWriteService");

async function search(req, res, next) {
  try {
    const result = await productService.search(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const product = await productService.getById(req.params.id);
    return res.status(200).json(product);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const product = await productWriteService.create(req.body);
    return res.status(201).json(product);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    await productWriteService.update(req.params.id, req.body);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await productWriteService.remove(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = { search, getById, create, update, remove };
