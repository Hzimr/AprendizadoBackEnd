const userService = require("../services/userService");

async function getById(req, res, next) {
  try {
    const user = await userService.getById(req.params.id);
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const user = await userService.create(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    await userService.update(req.params.id, req.body);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await userService.remove(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = { getById, create, update, remove };
