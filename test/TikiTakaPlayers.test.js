const TikiTakaPlayers = artifacts.require('TikiTakaPlayers');
const { expect } = require('chai');
const { BN, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

describe('TikiTakaPlayers', function () {
  let deployer, teamOwner, bidder1, bidder2;
  const name = "John Doe";
  const nationality = "American";
  const avatarCID = "QmYz6WxsekQgp5YS9L4Z4TxontP6WnGkd4or8T6FiY1k8y";
  const startPrice = ether('1');

  beforeEach(async function () {
    [deployer, teamOwner, bidder1, bidder2] = await web3.eth.getAccounts();
    this.tikiTakaPlayers = await TikiTakaPlayers.new({ from: deployer });
  });  

  describe('mintPlayer', function () {
    it('mints a new player and emits PlayerMinted event', async function () {
      const receipt = await this.tikiTakaPlayers.mintPlayer(teamOwner, name, nationality, avatarCID, { from: deployer });
      const tokenId = new BN('1');
      expectEvent(receipt, 'PlayerMinted', { tokenId: tokenId, teamOwner: teamOwner });
      const player = await this.tikiTakaPlayers.players(tokenId);
      expect(player.name).to.equal(name);
    });
  });

  describe('startAuction', function () {
    beforeEach(async function () {
      await this.tikiTakaPlayers.mintPlayer(teamOwner, name, nationality, avatarCID, { from: deployer });
    });

    it('starts an auction and emits AuctionStarted event', async function () {
      const tokenId = new BN('1');
      const receipt = await this.tikiTakaPlayers.startAuction(tokenId, startPrice, { from: teamOwner });
      expectEvent(receipt, 'AuctionStarted', { tokenId: tokenId });

      const auction = await this.tikiTakaPlayers.auctions(tokenId);
      expect(auction.startPrice).to.be.bignumber.equal(startPrice);
    });

    it('reverts if the sender is not the owner of the token', async function () {
      const tokenId = new BN('1');
      await expectRevert(
        this.tikiTakaPlayers.startAuction(tokenId, startPrice, { from: bidder1 }),
        'Not the owner',
      );
    });
  });

  describe('placeBid', function () {
    beforeEach(async function () {
      await this.tikiTakaPlayers.mintPlayer(teamOwner, name, nationality, avatarCID, { from: deployer });
      const tokenId = new BN('1');
      await this.tikiTakaPlayers.startAuction(tokenId, startPrice, { from: teamOwner });
    });

    it('allows a valid bid and emits BidPlaced event', async function () {
      const tokenId = new BN('1');
      const bidAmount = ether('2');
      const receipt = await this.tikiTakaPlayers.placeBid(tokenId, bidAmount, { from: bidder1, value: bidAmount });
      expectEvent(receipt, 'BidPlaced', { tokenId: tokenId, amount: bidAmount, bidder: bidder1 });
      const auction = await this.tikiTakaPlayers.auctions(tokenId);
      expect(auction.currentBid).to.be.bignumber.equal(bidAmount);
      expect(auction.currentBidder).to.equal(bidder1);
    });
    
    it('reverts if the auction has ended', async function () {
      const tokenId = new BN('1');
      const bidAmount = ether('2');
      await this.tikiTakaPlayers.auctions(tokenId);
      await time.increase(86400); // Fast-forward 1 day
      await expectRevert(
        this.tikiTakaPlayers.placeBid(tokenId, bidAmount, { from: bidder1, value: bidAmount }),
        'Auction ended',
      );
    });    
    
    it('reverts if the bid is below the start price', async function () {
      const tokenId = new BN('1');
      const bidAmount = ether('0.5');
      await expectRevert(
        this.tikiTakaPlayers.placeBid(tokenId, bidAmount, { from: bidder1, value: bidAmount }),
        'Bid below start price',
      );
    });
    
    it('reverts if the bid is below the current highest bid', async function () {
      const tokenId = new BN('1');
      const firstBidAmount = ether('2');
      await this.tikiTakaPlayers.placeBid(tokenId, firstBidAmount, { from: bidder1, value: firstBidAmount });
    
      const secondBidAmount = ether('1.5');
      await expectRevert(
        this.tikiTakaPlayers.placeBid(tokenId, secondBidAmount, { from: bidder2, value: secondBidAmount }),
        'Bid below current highest bid',
      );
    });
  });
  describe('finalizeAuction', function () {
    beforeEach(async function () {
      await this.tikiTakaPlayers.mintPlayer(teamOwner, name, nationality, avatarCID, { from: deployer });
      const tokenId = new BN('1');
      await this.tikiTakaPlayers.startAuction(tokenId, startPrice, { from: teamOwner });
      const bidAmount = ether('2');
      await this.tikiTakaPlayers.placeBid(tokenId, bidAmount, { from: bidder1, value: bidAmount });
      await time.increase(time.duration.days(1));
      await time.advanceBlock();
    });
  
    it('finalizes the auction, transfers NFT ownership, and emits AuctionEnded event', async function () {
      const tokenId = new BN('1');
      const finalBid = ether('2');
      const receipt = await this.tikiTakaPlayers.finalizeAuction(tokenId, { from: bidder1 });
      expectEvent(receipt, 'AuctionEnded', { tokenId: tokenId, winner: bidder1, finalBid: finalBid });
  
      const newOwner = await this.tikiTakaPlayers.ownerOf(tokenId);
      expect(newOwner).to.equal(bidder1);
    });
        
    it('reverts if the sender is not the highest bidder', async function () {
      const tokenId = new BN('1');
      await expectRevert(
        this.tikiTakaPlayers.finalizeAuction(tokenId, { from: bidder2 }),
        'Not the highest bidder',
        );
    });
  });

    describe('finalizeAuction with ongoing auction', function () {
      beforeEach(async function () {
        await this.tikiTakaPlayers.mintPlayer(teamOwner, name, nationality, avatarCID, { from: deployer });
        const tokenId = new BN('1');
        await this.tikiTakaPlayers.startAuction(tokenId, startPrice, { from: teamOwner });
        const bidAmount = ether('2');
        await this.tikiTakaPlayers.placeBid(tokenId, bidAmount, { from: bidder1, value: bidAmount });
      });

      it('reverts if the auction has not ended', async function () {
        const tokenId = new BN('1');
        await expectRevert(
          this.tikiTakaPlayers.finalizeAuction(tokenId, { from: bidder1 }),
          'Auction not ended',
        );
      });
  });

  describe('Edge cases', function () {
    beforeEach(async function () {
      await this.tikiTakaPlayers.mintPlayer(teamOwner, name, nationality, avatarCID, { from: deployer });
      const tokenId = new BN('1');
      await this.tikiTakaPlayers.startAuction(tokenId, startPrice, { from: teamOwner });
    });
    
    it('should refund the previous highest bidder when a new highest bid is placed', async function () {
      const tokenId = new BN('1');
      const firstBidAmount = ether('2');
      const secondBidAmount = ether('3');
    
      await this.tikiTakaPlayers.placeBid(tokenId, firstBidAmount, { from: bidder1, value: firstBidAmount });
      const bidder1InitialBalance = await web3.eth.getBalance(bidder1);
    
      await this.tikiTakaPlayers.placeBid(tokenId, secondBidAmount, { from: bidder2, value: secondBidAmount });
    
      const bidder1FinalBalance = await web3.eth.getBalance(bidder1);
      expect(new BN(bidder1FinalBalance)).to.be.bignumber.gte(new BN(bidder1InitialBalance));
    });
    
    it('should not allow finalizing an auction that does not exist', async function () {
      const nonExistentTokenId = new BN('999');
      await expectRevert(
        this.tikiTakaPlayers.finalizeAuction(nonExistentTokenId, { from: bidder1 }),
        "Not the highest bidder"
      );      
    });
    
    it('should not allow starting an auction for a non-existent token', async function () {
      const nonExistentTokenId = new BN('999');
      await expectRevert(
        this.tikiTakaPlayers.startAuction(nonExistentTokenId, startPrice, { from: teamOwner }),
        "ERC721: invalid token ID"
      );      
    });
    
    it('should not allow placing a bid for a non-existent auction', async function () {
      const nonExistentTokenId = new BN('999');
      const bidAmount = ether('2');
      await expectRevert(
        this.tikiTakaPlayers.placeBid(nonExistentTokenId, bidAmount, { from: bidder1, value: bidAmount }),
        "Auction ended"
      );      
    });
  });
});