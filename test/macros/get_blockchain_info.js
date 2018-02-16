const chainRpc = require('./chain_rpc');

const {getBlockCount} = require('./../conf/rpc_commands');

/** Get info about the best chain

  {
    network: <Network Name String>
  }

  @returns via cbk
  {
    current_height: <Block Height Number>
  }
*/
module.exports = (args, cbk) => {
  return chainRpc({
    cmd: getBlockCount,
    network: args.network,
  },
  (err, height) => {
    if (!!err) {
      return cbk(err);
    }

    return cbk(null, {current_height: height});
  });
};
