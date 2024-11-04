const { getDB } = require('../../config/db');
const { ObjectId } = require('mongodb');

const COLLECTION_NAME = 'users';

async function findAll() {
  const db = getDB();
  return await db.collection(COLLECTION_NAME).find().toArray();
}

async function findById(id) {
  const db = getDB();
  return await db.collection(COLLECTION_NAME).findOne({ _id: new ObjectId(id) });
}

async function create(data) {
  const db = getDB();
  const result = await db.collection(COLLECTION_NAME).insertOne(data);
  return findById(result.insertedId);
}

async function update(id, data) {
  const db = getDB();
  await db.collection(COLLECTION_NAME).updateOne(
    { _id: new ObjectId(id) },
    { $set: data }
  );
  return findById(id);
}

async function remove(id) {
  const db = getDB();
  await db.collection(COLLECTION_NAME).deleteOne({ _id: new ObjectId(id) });
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove
};
