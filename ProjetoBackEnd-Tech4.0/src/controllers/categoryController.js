const categoryService = require("../services/categoryService");

async function search(req, res, next) {
  try {
    const result = await categoryService.search(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const category = await categoryService.getById(req.params.id);
    return res.status(200).json(category);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const category = await categoryService.create(req.body);
    return res.status(201).json(category);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    await categoryService.update(req.params.id, req.body);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await categoryService.remove(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = { search, getById, create, update, remove };
