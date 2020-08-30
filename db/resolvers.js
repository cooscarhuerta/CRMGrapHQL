const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: 'variables.env'});

const crearToken = (usuario, secreta, expiresIn) => {
    const { id, email, nombre, apellido } = usuario;

    return jwt.sign({id, email, nombre, apellido}, secreta, { expiresIn });


};

// Resolvers

const resolvers = {
    Query: {
        // Usuarios
        obtenerUsuario: async (_, {}, ctx) => {
            return ctx.usuario;
        },
        // Productos
        obtenerProductos: async () => {
            try {
                return await Producto.find({});
            } catch (e) {
                console.log(e);
            }
        },
        obtenerProducto: async (_, { id }) => {
            // revisar si producto existe
            const producto = await Producto.findById(id);

            if(!producto) {
                throw new Error('Producto no encontrado');
            }

            return producto;
        },

        // Clientes
        obtenerClientes: async () => {
            try {
                return await Cliente.find({});
            } catch (e) {
                console.log(e)
            }
        },
        obtenerClientesVendedor: async (_, {}, ctx) => {
            try {
                return await Cliente.find({vendedor: ctx.usuario.id.toString()});
            } catch (e) {
                console.log(e)
            }
        },
        obtenerCliente: async (_, { id }, ctx) => {
            // Revisar si el cliente existe o no
            const cliente = await Cliente.findById(id);

            if(!cliente) {
                throw new Error('Cliente no encontrado');
            }

            // Quien lo creo puede verlo
            if(cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }

            return cliente;
        },

        // Pedidos
        obtenerPedidos: async () => {
            try {
                return await Pedido.find({});
            } catch (e) {
                console.log(e);
            }
        },
        obtenerPedidosVendedor: async (_, {}, ctx) => {
            try {
                return await Pedido.find({ vendedor: ctx.usuario.id}).populate('cliente');
            } catch (e) {
                console.log(e);
            }
        },
        obtenerPedido: async (_, {id}, ctx) => {
            // si el pedido existo o no
            const pedido = await Pedido.findById(id);
            if(!pedido) {
                throw new Error('Pedido no encontrado')
            }
            // Solo quien lo creo puede verlo

            if(pedido.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales')
            }
            return pedido;
        },
        obtenerPedidosEstado: async (_, { estado }, ctx) => {
            const pedidos = await Pedido.find({ vendedor: ctx.usuario.id, estado});
            return pedidos;
        },

        // Busqueda avanzada
        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                { $match: { estado: "COMPLETADO"}},
                {
                    $group: {
                        _id: "$cliente",
                        total: { $sum: '$total' }
                    }
                },
                {
                    $lookup: {
                        from: 'clientes',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'cliente'
                    }
                },
                {
                    $limit: 10
                },
                {
                    $sort: {total: -1}
                }
            ]);
            console.log(clientes);
            return clientes
        },
        mejoresVendedores: async () => {
            return Pedido.aggregate([
                { $match: { estado: "COMPLETADO"}},
                {
                    $group: {
                        _id: "$vendedor",
                        total: {$sum: '$total'}
                    }
                },
                {
                    $lookup: {
                        from: 'usuarios',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'vendedor'
                    }
                },
                {
                    $limit: 3
                },
                {
                    $sort: {total: -1}
                }
            ]);
        },
        buscarProducto: async (_, { texto }) => {
            return await Producto.find({ $text: { $search: texto}}).limit(10)
        }
    },
    Mutation: {
        // Usuarios
        nuevoUsuario: async (_, { input }) => {

            const { email, password } = input;

            // Revisar si usuario ya esta regstrado

            const existeusuario = await Usuario.findOne({email});
            if (existeusuario) {
                throw new Error('El usuario ya esta registrado');
            }
            // Hashear password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);


            try {
                // Guardar en base de datos

                const usuario = new Usuario(input);
                usuario.save();
                return usuario;
            } catch (e) {

            }
        },
        autenticarUsuario: async (_, {input}) => {

            const { email, password } = input;

            // Si el usuario existe
            const existeUsuario = await Usuario.findOne({email});
            if(!existeUsuario) {
                throw new Error('El usuario no existe');
            }

            // Revisar si el passwor es correcto
            const passwordCorrecto = await bcryptjs.compare( password, existeUsuario.password)
            if(!passwordCorrecto) {
                throw new Error('El password es incorrecto');
            }
            // Crear Token
            return {
                token: crearToken(existeUsuario, process.env.SECRETA, '24h')
            }
        },

        // Productos
        nuevoProducto: async (_, {input}) => {
            try {
                const producto = new Producto(input);

                // almacenar en la bd
                return await producto.save();

            } catch(error) {
                console.log(error);

            }
        },
        actualizarProducto: async (_, {id, input}) => {
            // revisar si producto existe
            let producto = await Producto.findById(id);

            if(!producto) {
                throw new Error('Producto no encontrado');
            }

            // Guardar en base de datos
            producto = await Producto.findOneAndUpdate({ _id: id }, input, { new: true } );
            return producto;
        },
        eliminarProducto: async (_, {id}) => {
            let producto = await Producto.findById(id);

            if(!producto) {
                throw new Error('Producto no encontrado');
            }

            await Producto.findOneAndDelete({_id: id});

            return 'Producto eliminado';
        },

        // Clientes
        nuevoCliente: async (_, {input}, ctx) => {
            // Verificar si el cliente ya esta registrado
            console.log(ctx);

            const { email } = input;
            console.log(input.email);
            const cliente = await Cliente.findOne({ email });
            if(cliente) {
                throw new Error('El cliente ya esta registrado');
            }

            const nuevocliente = new Cliente(input);

            // asignar el vendedor
            nuevocliente.vendedor = ctx.usuario.id;

            // almacenar en la bd
            try {

                return await nuevocliente.save();

            } catch(error) {
                console.log(error);
            }
        },
        actualizarCliente: async (_, {id, input}, ctx) => {
            // Verificas si existe o no
            console.log(id);
            let cliente = await Cliente.findById(id);

            if(!cliente) {
                throw new Error('El cliente no existe');
            }
            // Verificar si el vendedor es quien edita

            if(cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }

            // Guardar en base de datos
            cliente = await Cliente.findOneAndUpdate({ _id: id }, input, { new: true } );
            return cliente;
        },
        eliminarCliente: async (_, {id}, ctx) => {
            let cliente = await Cliente.findById(id);

            if(!cliente) {
                throw new Error('Cliente no encontrado');
            }

            if(cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }

            await Cliente.findOneAndDelete({_id: id});

            return 'Cliente eliminado';
        },

        // Pedidos

        nuevoPedido: async (_, {input}, ctx) => {

            const { cliente } = input;

            // Verificar si el cliente xiste o no
            let clienteExiste = await Cliente.findById(cliente);

            if(!clienteExiste) {
                throw new Error('Cliente no encontrado');
            }

            // Verificar si el clinte es del vendedor
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }

            // Revisar que el stock este disponible
            for await (const articulo of input.pedido) {

                const { id } = articulo;

                const producto = await Producto.findById(id);

                if (articulo.cantidad > producto.existencia) {
                    throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible`)
                } else {
                    // Restar cantidad a lo disponible
                    producto.existencia = producto.existencia - articulo.cantidad;

                    await producto.save();
                }
            }

            // Crear un nuevo pedido
            const nuevoPedido = new Pedido(input);

            // Asignarle un vendedor
            nuevoPedido.vendedor = ctx.usuario.id;

            // Guardar en la base de datos
            return await nuevoPedido.save();
        },
        actualizarPedido: async (_, {id, input}, ctx) => {

            const { cliente } = input;
            // Si el pedido existe
            const existePedido = await Pedido.findById(id);
            if(!existePedido) {
                throw new Error('El pedido no existe');
            }
            // Si el cliente existe
            const existeCliente = await Cliente.findById(cliente);
            if(!existeCliente) {
                throw new Error('El cliente no existe');
            }

            // Si el cliente y pedido pertenece al vendedor
            if(existeCliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }

            // Revisar el stock
            if (input.pedido) {
                console.log(input.pedido);
                for await (const articulo of input.pedido) {

                    const {id} = articulo;

                    const producto = await Producto.findById(id);

                    if (articulo.cantidad > producto.existencia) {
                        throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible`)
                    } else {
                        // Restar cantidad a lo disponible
                        producto.existencia = producto.existencia - articulo.cantidad;

                        await producto.save();
                    }
                }
            }
            // Guardar el pedido

            return await Pedido.findOneAndUpdate({_id: id}, input, {new: true});
        },
        eliminarPedido: async (_, {id}, ctx) => {
            // Verificar si existe el pedido
            const pedido = await Pedido.findById(id);
            if(!pedido) {
                throw new Error('No existe el pedido');
            }

            // Verificar si el vendedor es quien borra
            if(pedido.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }

            // Eliminar de la base de datos
            await Pedido.findOneAndDelete({_id: id});
            return 'Pedido eliminado';
        }
    }
}

module.exports = resolvers;