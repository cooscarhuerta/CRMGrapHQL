const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers')
const jwt = require('jsonwebtoken');
require('dotenv').config({path: 'variables.env'});

const conectarDB = require('./config/db');

// Conectar a la base de datos

conectarDB();

// servidor
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({req}) => {
        const token = req.headers['authorization'] || '';
        if(token) {
            try {
               const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.SECRETA );

               return {
                   usuario
               }
            } catch (e) {
                console.log(e);
            }
        }
    }
});

server.listen({port: process.env.PORT || 4000}).then( ({url}) => {
    console.log(`Servidor listo en la URL ${url}`)
} )

module.exports = resolvers;